/** Desktop design width. Below this, layout stays 1920px CSS and is scaled to the window. */
export const UI_DESIGN_WIDTH_PX = 1920

const SCALE_EPSILON = 0.995

function readScaleVar(root: HTMLElement): number | null {
  const raw =
    root.style.getPropertyValue('--ui-scale').trim() ||
    getComputedStyle(root).getPropertyValue('--ui-scale').trim()
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function clearScaleLock(root: HTMLElement): void {
  root.classList.remove('ui-scale-lock')
  root.style.removeProperty('--ui-scale')
  root.style.removeProperty('--app-vw')
  root.style.removeProperty('--app-vh')
}

/** Drop a stale lock left by cached bundles (class on html without a valid scale var). */
function repairStaleScaleLock(root: HTMLElement, viewportWidth: number): void {
  if (!root.classList.contains('ui-scale-lock')) return
  const scale = readScaleVar(root)
  if (scale == null || viewportWidth >= UI_DESIGN_WIDTH_PX * SCALE_EPSILON) {
    clearScaleLock(root)
  }
}

/**
 * Apply the 1920px desktop canvas only when the window is narrower than 1920.
 * At 1920+ this is a no-op so FHD stays native (no transform, no overflow clip).
 */
export function syncUiScaleLock(): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw <= 0 || vh <= 0) return

  repairStaleScaleLock(root, vw)

  if (vw >= UI_DESIGN_WIDTH_PX * SCALE_EPSILON) {
    clearScaleLock(root)
    return
  }

  const scale = vw / UI_DESIGN_WIDTH_PX
  const layoutHeight = vh / scale
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
