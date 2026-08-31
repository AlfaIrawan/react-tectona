import { getUiLayoutScale } from '@/lib/uiScale'

/** Shared viewport height for Project Timeline & Project Board panels. */
export const PROJECT_PANEL_BOTTOM_GAP_PX = 52
export const PROJECT_PANEL_MIN_HEIGHT_PX = 320
export const PROJECT_PANEL_HEIGHT_EXTRA_PX = 22

/** Fullscreen panel height in layout px (honors scaled 1920 canvas `--app-vh`). */
export const PROJECT_PANEL_FULLSCREEN_HEIGHT_STYLE = {
  height: 'calc(var(--app-vh, 100dvh) - 3rem)',
  maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)',
} as const

export function measureProjectPanelHeight(panelEl: HTMLElement): number {
  const scale = getUiLayoutScale()
  const topVisual = Math.max(0, panelEl.getBoundingClientRect().top)
  // innerHeight and getBoundingClientRect are viewport (visual) px; panel height is set in layout px.
  const availableLayout = Math.floor((window.innerHeight - topVisual) / scale) - PROJECT_PANEL_BOTTOM_GAP_PX
  return Math.max(PROJECT_PANEL_MIN_HEIGHT_PX, availableLayout) + PROJECT_PANEL_HEIGHT_EXTRA_PX
}
