/**
 * Shrink UI density on narrow viewports without faking a 1920px canvas.
 *
 * At >= COMFORT_WIDTH (and on true mobile widths) scale is 1, so 1920×1080
 * stays native. Below that, CSS zoom scales px and rem together; Tailwind
 * breakpoints still follow window.innerWidth.
 */

const COMFORT_WIDTH_PX = 1280
const MOBILE_MAX_PX = 640

function compactScale(innerWidth: number): number {
  if (innerWidth < MOBILE_MAX_PX || innerWidth >= COMFORT_WIDTH_PX) {
    return 1
  }
  return innerWidth / COMFORT_WIDTH_PX
}

function applyUiCompactZoom(): void {
  const scale = compactScale(window.innerWidth)
  const html = document.documentElement
  if (scale >= 0.999) {
    html.style.removeProperty('zoom')
    return
  }
  html.style.zoom = String(scale)
}

export function initUiCompactZoom(): void {
  applyUiCompactZoom()
  window.addEventListener('resize', applyUiCompactZoom)
  window.visualViewport?.addEventListener('resize', applyUiCompactZoom)
}
