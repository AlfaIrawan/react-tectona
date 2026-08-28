/** Design canvas width. Layout always thinks it is this wide; the page is scaled to the window. */
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
    root.style.removeProperty('zoom')
    return
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = vw / UI_DESIGN_WIDTH_PX
  root.classList.add('ui-scale-lock')
  root.style.setProperty('--ui-scale', String(scale))
  root.style.setProperty('--app-vw', `${UI_DESIGN_WIDTH_PX}px`)
  root.style.setProperty('--app-vh', `${vh / scale}px`)
}

export function initUiScaleLock(): void {
  syncUiScaleLock()
  window.addEventListener('resize', syncUiScaleLock)
  window.visualViewport?.addEventListener('resize', syncUiScaleLock)
}
