/** Desktop design canvas. Every viewport is this layout, uniformly scaled to fit. */
export const UI_DESIGN_WIDTH_PX = 1920
export const UI_DESIGN_HEIGHT_PX = 1080

const OPT_OUT_KEY = 'tectona:ui-scale-lock'

export function isUiScaleLockEnabled(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== '0'
  } catch {
    return true
  }
}

function viewportSize(): { width: number; height: number } {
  const vv = window.visualViewport
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height }
  }
  return { width: window.innerWidth, height: window.innerHeight }
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

  const { width: vw, height: vh } = viewportSize()
  const scale = Math.min(vw / UI_DESIGN_WIDTH_PX, vh / UI_DESIGN_HEIGHT_PX)
  const offsetX = (vw - UI_DESIGN_WIDTH_PX * scale) / 2
  const offsetY = (vh - UI_DESIGN_HEIGHT_PX * scale) / 2

  root.classList.add('ui-scale-lock')
  root.style.setProperty('--ui-scale', String(scale))
  root.style.setProperty('--app-vw', `${UI_DESIGN_WIDTH_PX}px`)
  root.style.setProperty('--app-vh', `${UI_DESIGN_HEIGHT_PX}px`)
  root.style.setProperty('--ui-offset-x', `${offsetX}px`)
  root.style.setProperty('--ui-offset-y', `${offsetY}px`)
}

export function initUiScaleLock(): void {
  syncUiScaleLock()
  window.addEventListener('resize', syncUiScaleLock)
  window.addEventListener('orientationchange', syncUiScaleLock)
  window.visualViewport?.addEventListener('resize', syncUiScaleLock)
  window.visualViewport?.addEventListener('scroll', syncUiScaleLock)
}
