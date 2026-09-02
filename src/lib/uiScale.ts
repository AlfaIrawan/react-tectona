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
  // Layout viewport only — visualViewport can be narrower than innerWidth and would
  // under-scale the canvas, leaving a white strip on the right of html { width: 100% }.
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw <= 0 || vh <= 0) return

  const scale = vw / UI_DESIGN_WIDTH_PX

  if (scale >= SCALE_EPSILON) {
    clearScaleLock(root)
    return
  }

  const layoutHeight = vh / scale
  // Set CSS vars before toggling the class so we never render one frame at scale(1)
  // with a 1920px body (the old right-gap bug on wide/zoomed desktops).
  root.style.setProperty('--ui-scale', String(scale))
  root.style.setProperty('--app-vw', `${UI_DESIGN_WIDTH_PX}px`)
  root.style.setProperty('--app-vh', `${layoutHeight}px`)
  root.classList.add('ui-scale-lock')
}

export function initUiScaleLock(): void {
  syncUiScaleLock()
  window.addEventListener('resize', syncUiScaleLock)
  window.addEventListener('orientationchange', syncUiScaleLock)
  window.addEventListener('pageshow', syncUiScaleLock)
  window.visualViewport?.addEventListener('resize', syncUiScaleLock)
  window.requestAnimationFrame(() => {
    syncUiScaleLock()
    window.requestAnimationFrame(syncUiScaleLock)
  })
}

/** Layout-px multiplier: 1 at native 1920+, otherwise innerWidth/1920. */
export function getUiLayoutScale(): number {
  if (typeof window === 'undefined') return 1
  if (!document.documentElement.classList.contains('ui-scale-lock')) return 1
  return window.innerWidth / UI_DESIGN_WIDTH_PX
}

/** Canvas height in layout px (`--app-vh` while scaled, otherwise the window). */
export function getUiLayoutViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim()
  const fromVar = Number.parseFloat(raw)
  if (Number.isFinite(fromVar) && fromVar > 0) return fromVar
  return window.innerHeight
}
