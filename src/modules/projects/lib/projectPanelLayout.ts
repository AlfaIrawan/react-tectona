/** Shared viewport height for Project Timeline & Project Board panels. */
export const PROJECT_PANEL_BOTTOM_GAP_PX = 52
export const PROJECT_PANEL_MIN_HEIGHT_PX = 320
export const PROJECT_PANEL_HEIGHT_EXTRA_PX = 22

export function measureProjectPanelHeight(panelEl: HTMLElement): number {
  const top = Math.max(0, panelEl.getBoundingClientRect().top)
  const available = Math.floor(window.innerHeight - top - PROJECT_PANEL_BOTTOM_GAP_PX)
  return Math.max(PROJECT_PANEL_MIN_HEIGHT_PX, available) + PROJECT_PANEL_HEIGHT_EXTRA_PX
}
