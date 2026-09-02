/** Desktop design width (legacy). ui-scale-lock is disabled — responsive layout only. */
export const UI_DESIGN_WIDTH_PX = 1920

function clearScaleLock(root: HTMLElement): void {
  root.classList.remove('ui-scale-lock')
  root.style.removeProperty('--ui-scale')
  root.style.removeProperty('--app-vw')
  root.style.removeProperty('--app-vh')
}

/**
 * Keep the shell at native viewport width. The old 1920px scaled canvas left a persistent
 * white strip on the right on ultrawide / zoomed Windows desktops when scale vars drifted.
 */
export function syncUiScaleLock(): void {
  if (typeof window === 'undefined') return
  clearScaleLock(document.documentElement)
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

/** Layout-px multiplier: always 1 (scale-lock disabled). */
export function getUiLayoutScale(): number {
  return 1
}

/** Canvas height in layout px (`--app-vh` while scaled, otherwise the window). */
export function getUiLayoutViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim()
  const fromVar = Number.parseFloat(raw)
  if (Number.isFinite(fromVar) && fromVar > 0) return fromVar
  return window.innerHeight
}
