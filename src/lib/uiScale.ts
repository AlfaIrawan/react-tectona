/** Desktop design width. Below this, layout stays 1920px CSS and is scaled to the window. */
export const UI_DESIGN_WIDTH_PX = 1920

const SCALE_EPSILON = 0.995

function clearScaleLock(root: HTMLElement): void {
  root.classList.remove('ui-scale-lock')
  root.style.removeProperty('--ui-scale')
  root.style.removeProperty('--app-vw')
  root.style.removeProperty('--app-vh')
}

/**
 * Apply the 1920px desktop canvas only when the window is narrower than 1920.
 * At 1920+ this is a no-op so FHD stays native (no transform, no overflow clip).
 * Scale is width-only — never min(width, height/1080), which shrank real FHD
 * because browser chrome makes innerHeight < 1080.
 */
export function syncUiScaleLock(): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = vw / UI_DESIGN_WIDTH_PX

  if (scale >= SCALE_EPSILON) {
    clearScaleLock(root)
    return
  }

  const layoutHeight = vh / scale
  root.classList.add('ui-scale-lock')
  root.style.setProperty('--ui-scale', String(scale))
  root.style.setProperty('--app-vw', `${UI_DESIGN_WIDTH_PX}px`)
  root.style.setProperty('--app-vh', `${layoutHeight}px`)
}

export function initUiScaleLock(): void {
  syncUiScaleLock()
  window.addEventListener('resize', syncUiScaleLock)
  window.addEventListener('orientationchange', syncUiScaleLock)
}

/** Layout-px multiplier: 1 at native 1920+, otherwise `--ui-scale`. */
export function getUiLayoutScale(): number {
  if (typeof window === 'undefined') return 1
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 1
}
